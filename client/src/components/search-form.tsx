import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Search, MapPin, Loader2 } from "lucide-react";
import { useLocation, useSearch } from "wouter";
import { apiRequest } from "@/lib/queryClient";

const HEALTH_PROFESSIONS = [
  "Physiothérapeute",
  "Psychologue",
  "Médecin généraliste",
  "Médecin spécialiste",
  "Infirmier(ère)",
  "Ergothérapeute",
  "Chiropraticien(ne)",
  "Ostéopathe",
  "Massothérapeute",
  "Orthophoniste",
  "Nutritionniste / Diététiste",
  "Travailleur(euse) social(e)",
  "Kinésiologue",
  "Podiatre",
  "Optométriste",
  "Dentiste",
  "Hygiéniste dentaire",
  "Pharmacien(ne)",
  "Sage-femme",
  "Acupuncteur(trice)",
  "Naturopathe",
  "Professionnel conjugal(e) et familial(e)",
];

export default function SearchForm() {
  const searchString = useSearch();
  const [profession, setProfession] = useState("");
  const [location, setLocation] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [filteredProfessions, setFilteredProfessions] = useState<string[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const suggestionRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  const [, navigate] = useLocation();

  // Initialiser les valeurs depuis l'URL au chargement
  useEffect(() => {
    const params = new URLSearchParams(searchString);
    const professionParam = params.get('profession');
    const cityParam = params.get('city');
    
    if (professionParam) {
      setProfession(professionParam);
    }
    if (cityParam) {
      setLocation(cityParam);
    }
  }, [searchString]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (suggestionRef.current && !suggestionRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleProfessionChange = (value: string) => {
    setProfession(value);
    
    if (value.trim().length > 0) {
      const filtered = HEALTH_PROFESSIONS.filter(prof =>
        prof.toLowerCase().includes(value.toLowerCase())
      );
      setFilteredProfessions(filtered);
      setShowSuggestions(filtered.length > 0);
      setSelectedIndex(-1);
    } else {
      setShowSuggestions(false);
      setFilteredProfessions([]);
    }
  };

  const handleSelectSuggestion = (selectedProfession: string) => {
    setProfession(selectedProfession);
    setShowSuggestions(false);
    setFilteredProfessions([]);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!showSuggestions) {
      if (e.key === 'Enter') {
        handleSearch();
      }
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(prev => 
          prev < filteredProfessions.length - 1 ? prev + 1 : prev
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(prev => prev > 0 ? prev - 1 : -1);
        break;
      case 'Enter':
        e.preventDefault();
        if (selectedIndex >= 0 && filteredProfessions[selectedIndex]) {
          handleSelectSuggestion(filteredProfessions[selectedIndex]);
        } else {
          handleSearch();
        }
        break;
      case 'Escape':
        setShowSuggestions(false);
        break;
    }
  };

  const handleSearch = async () => {
    console.log("Searching for:", { profession, location });
    
    if (!profession.trim() && !location.trim()) {
      toast({
        title: "Critères de recherche manquants",
        description: "Veuillez renseigner au moins une profession ou une ville.",
      });
      return;
    }
    
    setIsSearching(true);
    
    try {
      const params = new URLSearchParams();
      if (profession.trim()) params.append('profession', profession);
      if (location.trim()) params.append('city', location);
      
      const response = await apiRequest('GET', `/api/professionals/search?${params.toString()}`);
      const results = await response.json();
      
      toast({
        title: "Recherche terminée !",
        description: `${results.length} professionnel${results.length > 1 ? 's trouvés' : ' trouvé'} pour votre recherche.`,
      });
      
      // Navigate to results page with search parameters
      navigate(`/recherche?${params.toString()}`);
      
    } catch (error) {
      console.error("Search error:", error);
      toast({
        title: "Erreur de recherche",
        description: "Une erreur est survenue lors de la recherche. Veuillez réessayer.",
      });
    } finally {
      setIsSearching(false);
    }
  };

  return (
    <div className="bg-white rounded-xl sm:rounded-2xl shadow-2xl p-1.5 sm:p-2 flex flex-col sm:flex-row gap-1.5 sm:gap-2 items-stretch w-full max-w-5xl mx-auto">
      <div className="relative flex-1" ref={suggestionRef}>
        <Search className="absolute left-3 sm:left-5 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4 sm:h-6 sm:w-6 z-10" />
        <Input
          type="text"
          placeholder="Profession, spécialité..."
          value={profession}
          onChange={(e) => handleProfessionChange(e.target.value)}
          onKeyDown={handleKeyDown}
          className="pl-10 sm:pl-14 pr-3 sm:pr-4 py-2.5 sm:py-4 bg-white border-0 focus:border-0 focus:ring-0 rounded-lg sm:rounded-xl h-full text-sm sm:text-base text-gray-900 placeholder:text-gray-400 min-h-[44px]"
          data-testid="input-profession"
        />
        
        {showSuggestions && filteredProfessions.length > 0 && (
          <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-xl shadow-2xl border border-gray-200 max-h-64 overflow-y-auto z-50">
            {filteredProfessions.map((prof, index) => (
              <button
                key={prof}
                onClick={() => handleSelectSuggestion(prof)}
                className={`w-full text-left px-3 sm:px-5 py-3 sm:py-3 hover:bg-blue-50 transition-colors first:rounded-t-xl last:rounded-b-xl min-h-[44px] min-w-[44px] ${
                  index === selectedIndex ? 'bg-blue-100' : ''
                }`}
                data-testid={`suggestion-${index}`}
              >
                <span className="text-sm sm:text-base text-gray-900 font-medium">{prof}</span>
              </button>
            ))}
          </div>
        )}
      </div>
      <div className="hidden sm:block w-px bg-gray-200"></div>
      <div className="relative flex-1">
        <MapPin className="absolute left-3 sm:left-5 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4 sm:h-6 sm:w-6 z-10" />
        <Input
          type="text"
          placeholder="Où ?"
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          className="pl-10 sm:pl-14 pr-3 sm:pr-4 py-2.5 sm:py-4 bg-white border-0 focus:border-0 focus:ring-0 rounded-lg sm:rounded-xl h-full text-sm sm:text-base text-gray-900 placeholder:text-gray-400 min-h-[44px]"
          data-testid="input-location"
        />
      </div>
      <Button
        onClick={handleSearch}
        disabled={isSearching}
        className="gradient-button text-white px-6 sm:px-10 py-2.5 sm:py-4 font-semibold text-sm sm:text-base hover:opacity-90 transition-all whitespace-nowrap min-h-[44px] min-w-[44px] shadow-lg"
        data-testid="button-search"
      >
        {isSearching ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 sm:h-6 sm:w-6 animate-spin" />
            <span className="hidden sm:inline">Recherche...</span>
            <span className="sm:hidden">...</span>
          </>
        ) : (
          "Rechercher"
        )}
      </Button>
    </div>
  );
}
