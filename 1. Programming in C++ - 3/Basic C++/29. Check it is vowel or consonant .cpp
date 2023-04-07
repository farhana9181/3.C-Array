#include <iostream>
using namespace std;
int main()
{
   char n;
   cout<<"***   Enter a Alphabet for checking - it is Vowel or Consonant...   ***"<<endl;
   cout<<"Input a Alphabet  = ";
   cin>>n;

   if(n=='a'|| n=='e'|| n=='i' ||  n=='o '|| n=='u' )
   {
       cout<<"***  "<<n<< "  is Vowel ...***";
   }else if (n=='A'|| n=='E'|| n=='I' ||  n=='O'|| n=='U')
   {
       cout<<"***  "<<n<< "  is Vowel ...***";
   }
   else
   {
          cout<<"***  "<<n<< "  is Consonant...***";
   }
}
